package com.example.properity_project.service;

import com.example.properity_project.dto.VerificationDtos.*;
import com.example.properity_project.entity.*;
import com.example.properity_project.repository.*;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Seller verification. Uploading documents NEVER verifies anyone: only the agent's APPROVE decision
 * flips users.seller_enabled.
 */
@Service
@RequiredArgsConstructor
public class SellerVerificationService {

    private static final Set<String> OPEN = Set.of("PENDING", "UNDER_REVIEW", "VERIFIED");

    private final SellerVerificationRepository verifications;
    private final VerificationDocumentRepository docs;
    private final VerificationHistoryRepository history;
    private final UserRepository users;
    private final FileStorageService storage;
    private final NotificationService notifications;
    private final AuditService audit;

    @Transactional
    public MyVerification submit(User current, boolean consent, MultipartFile identity,
                                 MultipartFile address, MultipartFile photo) {
        User user = users.findById(current.getId()).orElseThrow(() -> Errors.notFound("User"));
        if (!user.isEmailVerified() || !user.isPhoneVerified()) {
            throw Errors.bad("Please verify your email and mobile number before applying");
        }
        if (!consent) throw Errors.bad("You must consent to the review of your documents");

        SellerVerification v = verifications.findFirstByUserIdOrderByIdDesc(user.getId()).orElse(null);
        boolean resubmission = v != null && v.getStatus().equals("RESUBMISSION_REQUIRED");
        if (v != null && OPEN.contains(v.getStatus())) {
            throw Errors.conflict(v.getStatus().equals("VERIFIED")
                    ? "You are already a verified seller" : "Your application is already being reviewed");
        }
        boolean fresh = v == null || v.getStatus().equals("REJECTED");
        if (fresh && (isEmpty(identity) || isEmpty(address) || isEmpty(photo))) {
            throw Errors.bad("Identity proof, address proof and a recent photograph are all required");
        }
        if (resubmission && isEmpty(identity) && isEmpty(address) && isEmpty(photo)) {
            throw Errors.bad("Upload at least one corrected document");
        }

        String from = v == null ? null : v.getStatus();
        if (fresh) {
            v = verifications.save(SellerVerification.builder().userId(user.getId()).status("PENDING")
                    .consentGiven(true).build());
        } else {
            v.setStatus("PENDING");
            v.setConsentGiven(true);
            v.setSubmittedAt(LocalDateTime.now());
            v.setUpdatedAt(LocalDateTime.now());
            v.setRejectionReason(null);
        }
        attach(v, "IDENTITY", identity, false);
        attach(v, "ADDRESS", address, false);
        attach(v, "PHOTO", photo, true);
        verifications.save(v);
        record(v, from, "PENDING", resubmission ? "Documents resubmitted" : "Application submitted", user.getId());
        audit.log(user.getId(), "SELLER_APPLICATION_SUBMITTED", "SellerVerification", v.getId(), null);
        notifications.notifyAgent("Seller application", user.getFullName() + " submitted documents for review",
                "/agent/verifications");
        return view(v);
    }

    public MyVerification mine(User user) {
        return verifications.findFirstByUserIdOrderByIdDesc(user.getId()).map(this::view).orElse(null);
    }

    // ---------------------------------------------------------------- agent side

    public Page<AgentVerification> list(List<String> statuses, int page, int size) {
        List<String> wanted = statuses == null || statuses.isEmpty()
                ? List.of("PENDING", "UNDER_REVIEW", "RESUBMISSION_REQUIRED", "REJECTED", "VERIFIED") : statuses;
        return verifications.findByStatusIn(wanted, PageRequest.of(page, size, Sort.by("id").descending()))
                .map(this::agentView);
    }

    public AgentVerification detail(Long id) {
        return agentView(find(id));
    }

    @Transactional
    public AgentVerification startReview(User agent, Long id) {
        SellerVerification v = find(id);
        if (!v.getStatus().equals("PENDING")) throw Errors.conflict("Only pending applications can be moved to review");
        transition(v, "UNDER_REVIEW", "Review started", agent);
        return agentView(v);
    }

    @Transactional
    public AgentVerification decide(User agent, Long id, DecisionRequest req) {
        SellerVerification v = find(id);
        if (!Set.of("PENDING", "UNDER_REVIEW").contains(v.getStatus())) {
            throw Errors.conflict("This application is not awaiting a decision");
        }
        User applicant = users.findById(v.getUserId()).orElseThrow(() -> Errors.notFound("User"));
        String action = req.action().toUpperCase();
        if (req.notes() != null && !req.notes().isBlank()) v.setReviewNotes(req.notes());
        switch (action) {
            case "APPROVE" -> {
                applicant.setSellerEnabled(true);
                transition(v, "VERIFIED", "Approved", agent);
                notifications.notify(applicant.getId(), "You are now a verified seller",
                        "You can now list properties from the Seller portal.", "/seller", true);
            }
            case "REJECT", "RESUBMIT" -> {
                if (req.reason() == null || req.reason().isBlank()) throw Errors.bad("A reason is required");
                v.setRejectionReason(req.reason());
                boolean reject = action.equals("REJECT");
                transition(v, reject ? "REJECTED" : "RESUBMISSION_REQUIRED", req.reason(), agent);
                notifications.notify(applicant.getId(),
                        reject ? "Seller application rejected" : "Please resubmit your documents",
                        req.reason(), "/account/seller-application", true);
            }
            default -> throw Errors.bad("Action must be APPROVE, REJECT or RESUBMIT");
        }
        audit.log(agent.getId(), "SELLER_" + action, "SellerVerification", v.getId(), req.reason());
        return agentView(v);
    }

    /** Only the applicant or the agent may fetch a verification document. */
    public VerificationDocument documentFor(User requester, Long docId) {
        VerificationDocument d = docs.findById(docId).orElseThrow(() -> Errors.notFound("Document"));
        SellerVerification v = find(d.getVerificationId());
        if (!requester.isAgent() && !v.getUserId().equals(requester.getId())) throw Errors.notFound("Document");
        audit.log(requester.getId(), "DOCUMENT_VIEWED", "VerificationDocument", docId, null);
        return d;
    }

    // ---------------------------------------------------------------- helpers

    private SellerVerification find(Long id) {
        return verifications.findById(id).orElseThrow(() -> Errors.notFound("Application"));
    }

    private void transition(SellerVerification v, String to, String note, User actor) {
        String from = v.getStatus();
        v.setStatus(to);
        v.setReviewedAt(LocalDateTime.now());
        v.setUpdatedAt(LocalDateTime.now());
        verifications.save(v);
        record(v, from, to, note, actor.getId());
    }

    private void record(SellerVerification v, String from, String to, String note, Long actor) {
        history.save(VerificationHistory.builder().verificationId(v.getId()).fromStatus(from).toStatus(to)
                .note(note).actorId(actor).build());
    }

    private void attach(SellerVerification v, String type, MultipartFile file, boolean imageOnly) {
        if (isEmpty(file)) return;
        docs.findByVerificationIdAndSupersededFalse(v.getId()).stream()
                .filter(d -> d.getDocType().equals(type)).forEach(d -> d.setSuperseded(true));
        var s = storage.store(file, imageOnly);
        docs.save(VerificationDocument.builder().verificationId(v.getId()).docType(type)
                .storedName(s.storedName()).originalName(s.originalName()).contentType(s.contentType())
                .sizeBytes(s.size()).build());
    }

    private static boolean isEmpty(MultipartFile f) {
        return f == null || f.isEmpty();
    }

    private List<DocView> docViews(Long id) {
        return docs.findByVerificationIdAndSupersededFalse(id).stream()
                .map(d -> new DocView(d.getId(), d.getDocType(), d.getOriginalName(), d.getUploadedAt())).toList();
    }

    private List<HistoryView> historyViews(Long id) {
        return history.findByVerificationIdOrderByIdAsc(id).stream()
                .map(h -> new HistoryView(h.getFromStatus(), h.getToStatus(), h.getNote(), h.getCreatedAt())).toList();
    }

    private MyVerification view(SellerVerification v) {
        return new MyVerification(v.getId(), v.getStatus(), v.getRejectionReason(), v.isConsentGiven(),
                v.getSubmittedAt(), v.getReviewedAt(), docViews(v.getId()), historyViews(v.getId()));
    }

    private AgentVerification agentView(SellerVerification v) {
        User u = users.findById(v.getUserId()).orElseThrow(() -> Errors.notFound("User"));
        return new AgentVerification(v.getId(), u.getId(), u.getFullName(), u.getEmail(), u.getPhone(), u.getCity(),
                v.getStatus(), v.getRejectionReason(), v.getReviewNotes(), v.isConsentGiven(), v.getSubmittedAt(),
                v.getReviewedAt(), docViews(v.getId()), historyViews(v.getId()));
    }
}
