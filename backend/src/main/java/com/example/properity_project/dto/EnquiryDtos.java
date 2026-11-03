package com.example.properity_project.dto;

import com.example.properity_project.dto.PropertyDtos.PropertyCard;
import com.example.properity_project.dto.PropertyDtos.SellerSummary;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class EnquiryDtos {
    private EnquiryDtos() {}

    public record CreateEnquiry(
            @NotNull(message = "Property is required") Long propertyId,
            @Pattern(regexp = "BUY|RENT|INFO|SITE_VISIT", message = "Choose a valid enquiry type") String enquiryType,
            @NotBlank(message = "Please write a message") @Size(max = 2000) String message) {}

    public record MessageRequest(@NotBlank(message = "Message is empty") @Size(max = 4000) String body, boolean internal) {}

    public record StatusUpdate(@NotBlank String status, String closureReason, String message) {}

    public record Triage(String priority, LocalDate followUpDate) {}

    public record VisitRequest(@NotNull @Future(message = "Choose a future date and time") LocalDateTime scheduledAt, String notes) {}

    public record VisitStatus(@NotBlank String status, String notes) {}

    public record OfferRequest(@NotNull @DecimalMin("1") BigDecimal amount, String note) {}

    public record OfferStatus(@NotBlank String status) {}

    /** "ME", "AGENT" or "SYSTEM" - the viewer never sees raw user ids of the other side. */
    public record MessageView(Long id, String from, String body, boolean internal, LocalDateTime at) {}

    public record VisitView(Long id, LocalDateTime scheduledAt, String status, String notes) {}

    public record OfferView(Long id, BigDecimal amount, String note, String status, LocalDateTime at) {}

    public record CustomerEnquiry(Long id, PropertyCard property, String enquiryType, String status, String message,
                                  LocalDateTime createdAt, LocalDateTime updatedAt) {}

    public record CustomerEnquiryDetail(CustomerEnquiry enquiry, List<MessageView> messages, List<VisitView> visits) {}

    public record AgentEnquiry(Long id, String status, String priority, LocalDate followUpDate, String closureReason,
                               String enquiryType, String message, LocalDateTime createdAt, LocalDateTime updatedAt,
                               PropertyCard property, String propertyAddress, SellerSummary buyer, SellerSummary seller) {}

    public record AgentEnquiryDetail(AgentEnquiry enquiry, List<MessageView> messages, List<VisitView> visits,
                                     List<OfferView> offers, Long saleId, Long rentalId) {}
}
