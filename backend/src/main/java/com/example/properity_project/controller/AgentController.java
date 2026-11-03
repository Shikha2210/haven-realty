package com.example.properity_project.controller;

import com.example.properity_project.dto.EnquiryDtos.*;
import com.example.properity_project.dto.PropertyDtos.*;
import com.example.properity_project.dto.RecordDtos.*;
import com.example.properity_project.dto.VerificationDtos.AgentVerification;
import com.example.properity_project.dto.VerificationDtos.DecisionRequest;
import com.example.properity_project.entity.User;
import com.example.properity_project.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** The one agent's console. /api/agent/** is restricted to ROLE_AGENT in SecurityConfig. */
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agent;
    private final SellerVerificationService verifications;
    private final PropertyService properties;
    private final EnquiryService enquiries;
    private final RecordsService records;
    private final ChannelService channels;

    public record Reason(String reason) {}
    public record Msg(@NotBlank String body, Long propertyId) {}

    // ---- dashboard, audit, export

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return agent.dashboard();
    }

    @GetMapping("/audit-logs")
    public Page<AgentService.AuditView> audit(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size) {
        return agent.auditTrail(page, size);
    }

    @GetMapping("/export/{what}")
    public ResponseEntity<byte[]> export(@PathVariable String what) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + what + ".xlsx\"")
                .body(agent.export(what));
    }

    @GetMapping("/export/{what}.pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable String what) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + what + ".pdf\"")
                .body(agent.exportPdf(what));
    }

    // ---- customers

    @GetMapping("/customers")
    public Page<AgentService.AgentCustomer> customers(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) String kind,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        return agent.customers(q, kind, page, size);
    }

    @GetMapping("/customers/{id}")
    public AgentService.AgentCustomer customer(@PathVariable Long id) {
        return agent.customer(id);
    }

    @PostMapping("/customers/{id}/suspend")
    public AgentService.AgentCustomer suspend(@AuthenticationPrincipal User a, @PathVariable Long id, @RequestBody Reason r) {
        return agent.setEnabled(a, id, false, r.reason());
    }

    @PostMapping("/customers/{id}/reactivate")
    public AgentService.AgentCustomer reactivate(@AuthenticationPrincipal User a, @PathVariable Long id) {
        return agent.setEnabled(a, id, true, null);
    }

    @GetMapping("/customers/{id}/messages")
    public List<Map<String, Object>> sellerThread(@PathVariable Long id) {
        return channels.agentThread(id);
    }

    @PostMapping("/customers/{id}/messages")
    public Map<String, Object> sellerSend(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody Msg m) {
        return channels.agentSend(a, id, m.body(), m.propertyId());
    }

    // ---- seller verification

    @GetMapping("/verifications")
    public Page<AgentVerification> verifications(@RequestParam(required = false) List<String> status,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return verifications.list(status, page, size);
    }

    @GetMapping("/verifications/{id}")
    public AgentVerification verification(@PathVariable Long id) {
        return verifications.detail(id);
    }

    @PostMapping("/verifications/{id}/review")
    public AgentVerification startReview(@AuthenticationPrincipal User a, @PathVariable Long id) {
        return verifications.startReview(a, id);
    }

    @PostMapping("/verifications/{id}/decision")
    public AgentVerification decide(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody DecisionRequest req) {
        return verifications.decide(a, id, req);
    }

    // ---- properties

    @GetMapping("/properties")
    public Page<AgentProperty> properties(@RequestParam(required = false) List<String> status,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return properties.adminList(status, q, page, size);
    }

    @GetMapping("/properties/{id}")
    public AgentProperty property(@PathVariable Long id) {
        return properties.adminOne(id);
    }

    @PutMapping("/properties/{id}")
    public AgentProperty editProperty(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody PropertyInput in) {
        return properties.adminUpdate(a, id, in);
    }

    @PostMapping("/properties/{id}/review")
    public AgentProperty reviewProperty(@AuthenticationPrincipal User a, @PathVariable Long id) {
        return properties.startReview(a, id);
    }

    @PostMapping("/properties/{id}/decision")
    public AgentProperty decideProperty(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody PropertyDecision d) {
        return properties.decide(a, id, d);
    }

    @PostMapping("/properties/{id}/status")
    public AgentProperty propertyStatus(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody StatusChange c) {
        return properties.setStatus(a, id, c);
    }

    // ---- enquiries (buyer <-> agent)

    @GetMapping("/enquiries")
    public Page<AgentEnquiry> enquiries(@RequestParam(required = false) List<String> status,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return enquiries.agentList(status, page, size);
    }

    @GetMapping("/enquiries/{id}")
    public AgentEnquiryDetail enquiry(@PathVariable Long id) {
        return enquiries.agentOne(id);
    }

    @PostMapping("/enquiries/{id}/messages")
    public AgentEnquiryDetail message(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody MessageRequest req) {
        return enquiries.agentMessage(a, id, req);
    }

    @PostMapping("/enquiries/{id}/status")
    public AgentEnquiryDetail status(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody StatusUpdate req) {
        return enquiries.agentStatus(a, id, req);
    }

    @PutMapping("/enquiries/{id}/triage")
    public AgentEnquiryDetail triage(@AuthenticationPrincipal User a, @PathVariable Long id, @RequestBody Triage t) {
        return enquiries.triage(a, id, t);
    }

    @PostMapping("/enquiries/{id}/site-visits")
    public AgentEnquiryDetail visit(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody VisitRequest req) {
        return enquiries.scheduleVisit(a, id, req);
    }

    @PutMapping("/site-visits/{id}")
    public AgentEnquiryDetail visitStatus(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody VisitStatus req) {
        return enquiries.visitStatus(a, id, req);
    }

    @PostMapping("/enquiries/{id}/offers")
    public AgentEnquiryDetail offer(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody OfferRequest req) {
        return enquiries.addOffer(a, id, req);
    }

    @PutMapping("/offers/{id}")
    public AgentEnquiryDetail offerStatus(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody OfferStatus req) {
        return enquiries.offerStatus(a, id, req);
    }

    // ---- sales and rentals

    @GetMapping("/sales")
    public List<SaleView> sales() {
        return records.sales();
    }

    @PostMapping("/sales")
    public SaleView createSale(@AuthenticationPrincipal User a, @Valid @RequestBody SaleInput in) {
        return records.createSale(a, in);
    }

    @PutMapping("/sales/{id}")
    public SaleView updateSale(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody SaleInput in) {
        return records.updateSale(a, id, in);
    }

    @GetMapping("/rentals")
    public List<RentalView> rentals() {
        return records.rentals();
    }

    @PostMapping("/rentals")
    public RentalView createRental(@AuthenticationPrincipal User a, @Valid @RequestBody RentalInput in) {
        return records.createRental(a, in);
    }

    @PutMapping("/rentals/{id}")
    public RentalView updateRental(@AuthenticationPrincipal User a, @PathVariable Long id, @Valid @RequestBody RentalInput in) {
        return records.updateRental(a, id, in);
    }
}
