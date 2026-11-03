package com.example.properity_project.service;

import com.example.properity_project.dto.RecordDtos.*;
import com.example.properity_project.entity.*;
import com.example.properity_project.repository.*;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Sale transactions (the old desktop "Deals" screen) and rental agreements. Agent-only.
 * Rule carried over from the desktop app: a COMPLETED deal marks the property SOLD.
 */
@Service
@RequiredArgsConstructor
public class RecordsService {

    private static final Set<String> SALE_STATUS = Set.of("ONGOING", "COMPLETED", "CANCELLED");
    private static final Set<String> RENTAL_STATUS = Set.of("ACTIVE", "RENEWAL_DUE", "EXPIRED", "TERMINATED");

    private final SaleTransactionRepository sales;
    private final RentalAgreementRepository rentals;
    private final EnquiryRepository enquiries;
    private final PropertyRepository properties;
    private final UserRepository users;
    private final PropertyService propertyService;
    private final EnquiryService enquiryService;
    private final NotificationService notifications;
    private final AuditService audit;

    // ------------------------------------------------------------------ sales

    public List<SaleView> sales() {
        return sales.findAll(Sort.by("id").descending()).stream().map(this::view).toList();
    }

    public SaleView sale(Long id) {
        return view(sales.findById(id).orElseThrow(() -> Errors.notFound("Sale")));
    }

    @Transactional
    public SaleView createSale(User agent, SaleInput in) {
        Long propertyId = in.propertyId();
        Long buyerId = in.buyerId();
        if (in.enquiryId() != null) {
            Enquiry e = enquiries.findById(in.enquiryId()).orElseThrow(() -> Errors.notFound("Enquiry"));
            propertyId = e.getPropertyId();
            buyerId = e.getCustomerId();
        }
        if (propertyId == null || buyerId == null) throw Errors.bad("Pick an enquiry, or a property and a buyer");
        Property p = properties.findById(propertyId).orElseThrow(() -> Errors.notFound("Property"));
        users.findById(buyerId).filter(u -> !u.isAgent()).orElseThrow(() -> Errors.notFound("Buyer"));
        if (p.getSellerId().equals(buyerId)) throw Errors.bad("Buyer and seller cannot be the same person");
        if (sales.existsByPropertyIdAndStatus(propertyId, "ONGOING")) throw Errors.conflict("This property already has an ongoing deal");

        BigDecimal down = in.downPayment() == null ? BigDecimal.ZERO : in.downPayment();
        if (down.compareTo(in.finalAmount()) > 0) throw Errors.bad("Down payment cannot exceed the final amount");
        String status = in.status() == null ? "ONGOING" : in.status().toUpperCase();
        if (!SALE_STATUS.contains(status)) throw Errors.bad("Unknown status");

        SaleTransaction t = sales.save(SaleTransaction.builder().enquiryId(in.enquiryId()).propertyId(propertyId)
                .buyerId(buyerId).sellerId(p.getSellerId()).finalAmount(in.finalAmount()).downPayment(down)
                .dealDate(in.dealDate()).registryDate(in.registryDate())
                .totalCommission(in.totalCommission() == null ? BigDecimal.ZERO : in.totalCommission())
                .advanceReceived(in.advanceReceived()).balanceReceived(in.balanceReceived()).status("ONGOING").notes(in.notes()).build());
        enquiryService.moveTo(in.enquiryId(), "DEAL_IN_PROGRESS", null, agent.getId());
        audit.log(agent.getId(), "SALE_CREATED", "SaleTransaction", t.getId(), p.getTitle());
        notifications.notify(p.getSellerId(), "Deal in progress", "A deal is now in progress for " + p.getTitle()
                + ". Your agent will keep you updated.", "/seller/messages", false);
        if (!status.equals("ONGOING")) applyStatus(agent, t, p, status);
        return view(t);
    }

    @Transactional
    public SaleView updateSale(User agent, Long id, SaleInput in) {
        SaleTransaction t = sales.findById(id).orElseThrow(() -> Errors.notFound("Sale"));
        Property p = properties.findById(t.getPropertyId()).orElseThrow();
        BigDecimal down = in.downPayment() == null ? BigDecimal.ZERO : in.downPayment();
        if (down.compareTo(in.finalAmount()) > 0) throw Errors.bad("Down payment cannot exceed the final amount");
        t.setFinalAmount(in.finalAmount());
        t.setDownPayment(down);
        t.setDealDate(in.dealDate());
        t.setRegistryDate(in.registryDate());
        t.setTotalCommission(in.totalCommission() == null ? BigDecimal.ZERO : in.totalCommission());
        t.setAdvanceReceived(in.advanceReceived());
        t.setBalanceReceived(in.balanceReceived());
        t.setNotes(in.notes());
        String status = in.status() == null ? t.getStatus() : in.status().toUpperCase();
        if (!SALE_STATUS.contains(status)) throw Errors.bad("Unknown status");
        if (!status.equals(t.getStatus())) applyStatus(agent, t, p, status);
        audit.log(agent.getId(), "SALE_UPDATED", "SaleTransaction", id, status);
        return view(t);
    }

    private void applyStatus(User agent, SaleTransaction t, Property p, String status) {
        if (t.getStatus().equals("COMPLETED")) throw Errors.conflict("A completed deal cannot be changed");
        t.setStatus(status);
        if (status.equals("COMPLETED")) {
            propertyService.markStatus(p, "SOLD", agent.getId(), "Deal completed");
            enquiryService.moveTo(t.getEnquiryId(), "CLOSED", "Deal completed", agent.getId());
            notifications.notify(t.getBuyerId(), "Congratulations - your purchase is complete", p.getTitle(), "/enquiries", true);
        } else if (status.equals("CANCELLED")) {
            enquiryService.moveTo(t.getEnquiryId(), "NEGOTIATION", null, agent.getId());
            notifications.notify(p.getSellerId(), "Deal did not go through", "The deal for " + p.getTitle()
                    + " was cancelled. Your listing stays as it was.", "/seller/messages", false);
        }
    }

    // ------------------------------------------------------------------ rentals

    public List<RentalView> rentals() {
        return rentals.findAll(Sort.by("id").descending()).stream().map(this::view).toList();
    }

    @Transactional
    public RentalView createRental(User agent, RentalInput in) {
        Long propertyId = in.propertyId();
        Long tenantId = in.tenantId();
        if (in.enquiryId() != null) {
            Enquiry e = enquiries.findById(in.enquiryId()).orElseThrow(() -> Errors.notFound("Enquiry"));
            propertyId = e.getPropertyId();
            tenantId = e.getCustomerId();
        }
        if (propertyId == null || tenantId == null) throw Errors.bad("Pick an enquiry, or a property and a tenant");
        if (!in.endDate().isAfter(in.startDate())) throw Errors.bad("End date must be after the start date");
        Property p = properties.findById(propertyId).orElseThrow(() -> Errors.notFound("Property"));
        users.findById(tenantId).filter(u -> !u.isAgent()).orElseThrow(() -> Errors.notFound("Tenant"));
        if (p.getSellerId().equals(tenantId)) throw Errors.bad("Tenant and owner cannot be the same person");

        RentalAgreement r = rentals.save(RentalAgreement.builder().enquiryId(in.enquiryId()).propertyId(propertyId)
                .tenantId(tenantId).rentAmount(in.rentAmount()).securityDeposit(in.securityDeposit())
                .startDate(in.startDate()).endDate(in.endDate()).renewalDate(in.renewalDate()).notes(in.notes()).build());
        if (p.getStatus().equals(PropertyService.PUBLISHED)) propertyService.markStatus(p, "INACTIVE", agent.getId(), "Rented out");
        enquiryService.moveTo(in.enquiryId(), "CLOSED", "Rental agreement created", agent.getId());
        notifications.notify(tenantId, "Your rental agreement has been recorded", p.getTitle(), "/enquiries", true);
        audit.log(agent.getId(), "RENTAL_CREATED", "RentalAgreement", r.getId(), p.getTitle());
        return view(r);
    }

    @Transactional
    public RentalView updateRental(User agent, Long id, RentalInput in) {
        RentalAgreement r = rentals.findById(id).orElseThrow(() -> Errors.notFound("Rental"));
        if (!in.endDate().isAfter(in.startDate())) throw Errors.bad("End date must be after the start date");
        String status = in.status() == null ? r.getStatus() : in.status().toUpperCase();
        if (!RENTAL_STATUS.contains(status)) throw Errors.bad("Unknown status");
        r.setRentAmount(in.rentAmount());
        r.setSecurityDeposit(in.securityDeposit());
        r.setStartDate(in.startDate());
        r.setEndDate(in.endDate());
        r.setRenewalDate(in.renewalDate());
        r.setStatus(status);
        r.setNotes(in.notes());
        audit.log(agent.getId(), "RENTAL_UPDATED", "RentalAgreement", id, status);
        return view(r);
    }

    // ------------------------------------------------------------------ mapping

    private SaleView view(SaleTransaction t) {
        Property p = properties.findById(t.getPropertyId()).orElseThrow();
        User b = users.findById(t.getBuyerId()).orElseThrow();
        User s = users.findById(t.getSellerId()).orElseThrow();
        return new SaleView(t.getId(), t.getEnquiryId(), p.getId(), p.getTitle(), b.getId(), b.getFullName(), b.getPhone(),
                s.getId(), s.getFullName(), s.getPhone(), t.getFinalAmount(), t.getDownPayment(), t.getDealDate(),
                t.getRegistryDate(), t.getTotalCommission(), t.isAdvanceReceived(), t.isBalanceReceived(), t.getStatus(),
                t.getNotes(), t.getCreatedAt());
    }

    private RentalView view(RentalAgreement r) {
        Property p = properties.findById(r.getPropertyId()).orElseThrow();
        User t = users.findById(r.getTenantId()).orElseThrow();
        return new RentalView(r.getId(), r.getEnquiryId(), p.getId(), p.getTitle(), t.getId(), t.getFullName(), t.getPhone(),
                r.getRentAmount(), r.getSecurityDeposit(), r.getStartDate(), r.getEndDate(), r.getRenewalDate(), r.getStatus(),
                r.getNotes(), r.getCreatedAt());
    }
}
