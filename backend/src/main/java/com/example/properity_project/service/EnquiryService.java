package com.example.properity_project.service;

import com.example.properity_project.dto.EnquiryDtos.*;
import com.example.properity_project.dto.PropertyDtos.SellerSummary;
import com.example.properity_project.entity.*;
import com.example.properity_project.repository.*;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Enquiry lifecycle and the BUYER <-> AGENT channel.
 * NEW -> UNDER_REVIEW -> CONTACTED -> DETAILS_SHARED -> SITE_VISIT_SCHEDULED -> NEGOTIATION
 *     -> DEAL_IN_PROGRESS -> CLOSED, plus REJECTED / ON_HOLD / CANCELLED.
 *
 * Privacy: customer-facing methods only ever return the customer's OWN enquiries and the non-internal
 * messages; seller identity is never part of any customer DTO.
 */
@Service
@RequiredArgsConstructor
public class EnquiryService {

    public static final Set<String> STATUSES = Set.of("NEW", "UNDER_REVIEW", "CONTACTED", "DETAILS_SHARED",
            "SITE_VISIT_SCHEDULED", "NEGOTIATION", "DEAL_IN_PROGRESS", "CLOSED", "REJECTED", "ON_HOLD", "CANCELLED");
    private static final Set<String> FINISHED = Set.of("CLOSED", "REJECTED", "CANCELLED");

    private final EnquiryRepository enquiries;
    private final PropertyRepository properties;
    private final UserRepository users;
    private final BuyerAgentMessageRepository messages;
    private final SiteVisitRepository visits;
    private final PropertyOfferRepository offers;
    private final SaleTransactionRepository sales;
    private final RentalAgreementRepository rentals;
    private final PropertyService propertyService;
    private final NotificationService notifications;
    private final AuditService audit;

    // ================================================================ customer side

    @Transactional
    public CustomerEnquiry create(User customer, CreateEnquiry req) {
        if (!customer.isEmailVerified()) throw Errors.forbidden("Please verify your email before sending enquiries");
        Property p = properties.findById(req.propertyId())
                .filter(x -> PropertyService.PUBLISHED.equals(x.getStatus())).orElseThrow(() -> Errors.notFound("Property"));
        if (p.getSellerId().equals(customer.getId())) throw Errors.bad("You cannot enquire about your own property");
        boolean open = enquiries.findByCustomerIdOrderByIdDesc(customer.getId()).stream()
                .anyMatch(e -> e.getPropertyId().equals(p.getId()) && !FINISHED.contains(e.getStatus()));
        if (open) throw Errors.conflict("You already have an open enquiry for this property. Add a message to it instead.");

        Enquiry e = enquiries.save(Enquiry.builder().propertyId(p.getId()).customerId(customer.getId())
                .enquiryType(req.enquiryType() == null ? "INFO" : req.enquiryType()).message(req.message().trim()).build());
        messages.save(BuyerAgentMessage.builder().enquiryId(e.getId()).senderRole("CUSTOMER").senderId(customer.getId())
                .body(req.message().trim()).build());
        system(e, "Your enquiry was received. Our agent will contact you shortly.");

        notifications.notifyAgent("New enquiry", customer.getFullName() + " asked about " + p.getTitle(), "/agent/enquiries/" + e.getId());
        notifications.notify(p.getSellerId(), "New interest in your listing", "Someone enquired about " + p.getTitle()
                + ". Our agent is handling it.", "/seller/properties", false);
        audit.log(customer.getId(), "ENQUIRY_CREATED", "Enquiry", e.getId(), null);
        return customerView(e);
    }

    public List<CustomerEnquiry> mine(User customer) {
        return enquiries.findByCustomerIdOrderByIdDesc(customer.getId()).stream().map(this::customerView).toList();
    }

    public CustomerEnquiryDetail mineOne(User customer, Long id) {
        Enquiry e = ownedBy(customer, id);
        return new CustomerEnquiryDetail(customerView(e),
                messages.findByEnquiryIdAndInternalNoteFalseOrderByIdAsc(id).stream().map(m -> msgView(m, "CUSTOMER")).toList(),
                visits.findByEnquiryIdOrderByScheduledAtAsc(id).stream().map(this::visitView).toList());
    }

    @Transactional
    public CustomerEnquiryDetail customerMessage(User customer, Long id, String body) {
        Enquiry e = ownedBy(customer, id);
        if (FINISHED.contains(e.getStatus())) throw Errors.conflict("This enquiry is closed");
        messages.save(BuyerAgentMessage.builder().enquiryId(id).senderRole("CUSTOMER").senderId(customer.getId()).body(body.trim()).build());
        e.setUpdatedAt(LocalDateTime.now());
        notifications.notifyAgent("Reply from " + customer.getFullName(), body, "/agent/enquiries/" + id);
        return mineOne(customer, id);
    }

    @Transactional
    public CustomerEnquiryDetail cancel(User customer, Long id) {
        Enquiry e = ownedBy(customer, id);
        if (FINISHED.contains(e.getStatus())) throw Errors.conflict("This enquiry is already finished");
        setStatus(e, "CANCELLED", "Cancelled by customer", customer.getId(), false);
        return mineOne(customer, id);
    }

    private Enquiry ownedBy(User customer, Long id) {
        // not-found (not forbidden) so ids of other people's enquiries cannot be probed
        return enquiries.findById(id).filter(e -> e.getCustomerId().equals(customer.getId()))
                .orElseThrow(() -> Errors.notFound("Enquiry"));
    }

    // ================================================================ agent side

    public Page<AgentEnquiry> agentList(List<String> statuses, int page, int size) {
        List<String> wanted = statuses == null || statuses.isEmpty() ? List.copyOf(STATUSES) : statuses;
        return enquiries.findByStatusIn(wanted, PageRequest.of(page, size, Sort.by("updatedAt").descending()))
                .map(this::agentView);
    }

    public AgentEnquiryDetail agentOne(Long id) {
        Enquiry e = find(id);
        Long saleId = sales.findFirstByEnquiryIdOrderByIdDesc(id).map(SaleTransaction::getId).orElse(null);
        Long rentalId = rentals.findFirstByEnquiryIdOrderByIdDesc(id).map(RentalAgreement::getId).orElse(null);
        return new AgentEnquiryDetail(agentView(e),
                messages.findByEnquiryIdOrderByIdAsc(id).stream().map(m -> msgView(m, "AGENT")).toList(),
                visits.findByEnquiryIdOrderByScheduledAtAsc(id).stream().map(this::visitView).toList(),
                offers.findByEnquiryIdOrderByIdAsc(id).stream()
                        .map(o -> new OfferView(o.getId(), o.getAmount(), o.getNote(), o.getStatus(), o.getCreatedAt())).toList(),
                saleId, rentalId);
    }

    @Transactional
    public AgentEnquiryDetail agentMessage(User agent, Long id, MessageRequest req) {
        Enquiry e = find(id);
        messages.save(BuyerAgentMessage.builder().enquiryId(id).senderRole("AGENT").senderId(agent.getId())
                .body(req.body().trim()).internalNote(req.internal()).build());
        e.setUpdatedAt(LocalDateTime.now());
        if (!req.internal()) {
            if (e.getStatus().equals("NEW")) setStatus(e, "UNDER_REVIEW", null, agent.getId(), false);
            notifications.notify(e.getCustomerId(), "Update on your enquiry", req.body(), "/enquiries/" + id, true);
        }
        return agentOne(id);
    }

    @Transactional
    public AgentEnquiryDetail agentStatus(User agent, Long id, StatusUpdate req) {
        Enquiry e = find(id);
        String status = req.status().toUpperCase();
        if (!STATUSES.contains(status) || status.equals("NEW")) throw Errors.bad("Unknown status");
        if (FINISHED.contains(status) && (req.closureReason() == null || req.closureReason().isBlank())) {
            throw Errors.bad("A reason is required to close, reject or cancel an enquiry");
        }
        setStatus(e, status, req.closureReason(), agent.getId(), true);
        if (req.message() != null && !req.message().isBlank()) {
            messages.save(BuyerAgentMessage.builder().enquiryId(id).senderRole("AGENT").senderId(agent.getId()).body(req.message().trim()).build());
        }
        return agentOne(id);
    }

    @Transactional
    public AgentEnquiryDetail triage(User agent, Long id, Triage t) {
        Enquiry e = find(id);
        if (t.priority() != null) {
            if (!Set.of("LOW", "NORMAL", "HIGH").contains(t.priority().toUpperCase())) throw Errors.bad("Priority must be LOW, NORMAL or HIGH");
            e.setPriority(t.priority().toUpperCase());
        }
        e.setFollowUpDate(t.followUpDate());
        e.setUpdatedAt(LocalDateTime.now());
        audit.log(agent.getId(), "ENQUIRY_TRIAGED", "Enquiry", id, e.getPriority());
        return agentOne(id);
    }

    @Transactional
    public AgentEnquiryDetail scheduleVisit(User agent, Long id, VisitRequest req) {
        Enquiry e = find(id);
        if (FINISHED.contains(e.getStatus())) throw Errors.conflict("This enquiry is closed");
        visits.save(SiteVisit.builder().enquiryId(id).scheduledAt(req.scheduledAt()).notes(req.notes()).build());
        if (Set.of("NEW", "UNDER_REVIEW", "CONTACTED", "DETAILS_SHARED").contains(e.getStatus())) {
            setStatus(e, "SITE_VISIT_SCHEDULED", null, agent.getId(), false);
        }
        Property p = properties.findById(e.getPropertyId()).orElseThrow();
        notifications.notify(e.getCustomerId(), "Site visit scheduled",
                p.getTitle() + " on " + req.scheduledAt().toString().replace('T', ' '), "/enquiries/" + id, true);
        notifications.notify(p.getSellerId(), "Site visit planned for your property",
                p.getTitle() + " on " + req.scheduledAt().toString().replace('T', ' ') + ". The agent will coordinate with you.",
                "/seller/properties", true);
        audit.log(agent.getId(), "SITE_VISIT_SCHEDULED", "Enquiry", id, req.scheduledAt().toString());
        return agentOne(id);
    }

    @Transactional
    public AgentEnquiryDetail visitStatus(User agent, Long visitId, VisitStatus req) {
        SiteVisit v = visits.findById(visitId).orElseThrow(() -> Errors.notFound("Site visit"));
        String s = req.status().toUpperCase();
        if (!Set.of("SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW").contains(s)) throw Errors.bad("Unknown visit status");
        v.setStatus(s);
        if (req.notes() != null) v.setNotes(req.notes());
        return agentOne(v.getEnquiryId());
    }

    @Transactional
    public AgentEnquiryDetail addOffer(User agent, Long id, OfferRequest req) {
        find(id);
        offers.save(PropertyOffer.builder().enquiryId(id).amount(req.amount()).note(req.note()).build());
        audit.log(agent.getId(), "OFFER_RECORDED", "Enquiry", id, req.amount().toPlainString());
        return agentOne(id);
    }

    @Transactional
    public AgentEnquiryDetail offerStatus(User agent, Long offerId, OfferStatus req) {
        PropertyOffer o = offers.findById(offerId).orElseThrow(() -> Errors.notFound("Offer"));
        String s = req.status().toUpperCase();
        if (!Set.of("OPEN", "ACCEPTED", "REJECTED", "COUNTERED").contains(s)) throw Errors.bad("Unknown offer status");
        o.setStatus(s);
        audit.log(agent.getId(), "OFFER_" + s, "Enquiry", o.getEnquiryId(), o.getAmount().toPlainString());
        return agentOne(o.getEnquiryId());
    }

    /** Used by sale / rental management to move a deal forward. */
    @Transactional
    public void moveTo(Long enquiryId, String status, String reason, Long actorId) {
        if (enquiryId == null) return;
        enquiries.findById(enquiryId).ifPresent(e -> setStatus(e, status, reason, actorId, true));
    }

    // ================================================================ helpers

    private Enquiry find(Long id) {
        return enquiries.findById(id).orElseThrow(() -> Errors.notFound("Enquiry"));
    }

    private void setStatus(Enquiry e, String status, String reason, Long actorId, boolean tellCustomer) {
        if (e.getStatus().equals(status)) return;
        e.setStatus(status);
        if (FINISHED.contains(status)) e.setClosureReason(reason);
        e.setUpdatedAt(LocalDateTime.now());
        system(e, "Status changed to " + status.replace('_', ' ').toLowerCase()
                + (reason != null && !reason.isBlank() && FINISHED.contains(status) ? " - " + reason : ""));
        if (tellCustomer) {
            notifications.notify(e.getCustomerId(), "Your enquiry is now: " + status.replace('_', ' ').toLowerCase(),
                    reason, "/enquiries/" + e.getId(), true);
        }
        audit.log(actorId, "ENQUIRY_" + status, "Enquiry", e.getId(), reason);
    }

    private void system(Enquiry e, String text) {
        messages.save(BuyerAgentMessage.builder().enquiryId(e.getId()).senderRole("SYSTEM").senderId(0L).body(text).build());
    }

    private MessageView msgView(BuyerAgentMessage m, String viewer) {
        String from = m.getSenderRole().equals("SYSTEM") ? "SYSTEM" : (m.getSenderRole().equals(viewer) ? "ME" : (m.getSenderRole().equals("AGENT") ? "AGENT" : "CUSTOMER"));
        return new MessageView(m.getId(), from, m.getBody(), m.isInternalNote(), m.getCreatedAt());
    }

    private VisitView visitView(SiteVisit v) {
        return new VisitView(v.getId(), v.getScheduledAt(), v.getStatus(), v.getNotes());
    }

    private CustomerEnquiry customerView(Enquiry e) {
        Property p = properties.findById(e.getPropertyId()).orElseThrow();
        return new CustomerEnquiry(e.getId(), propertyService.cardFor(p), e.getEnquiryType(), e.getStatus(), e.getMessage(),
                e.getCreatedAt(), e.getUpdatedAt());
    }

    private AgentEnquiry agentView(Enquiry e) {
        Property p = properties.findById(e.getPropertyId()).orElseThrow();
        User buyer = users.findById(e.getCustomerId()).orElseThrow();
        User seller = users.findById(p.getSellerId()).orElseThrow();
        return new AgentEnquiry(e.getId(), e.getStatus(), e.getPriority(), e.getFollowUpDate(), e.getClosureReason(),
                e.getEnquiryType(), e.getMessage(), e.getCreatedAt(), e.getUpdatedAt(), propertyService.cardFor(p), p.getAddress(),
                new SellerSummary(buyer.getId(), buyer.getFullName(), buyer.getEmail(), buyer.getPhone(), buyer.getCity()),
                new SellerSummary(seller.getId(), seller.getFullName(), seller.getEmail(), seller.getPhone(), seller.getCity()));
    }
}
