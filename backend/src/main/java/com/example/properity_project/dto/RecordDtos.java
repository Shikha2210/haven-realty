package com.example.properity_project.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class RecordDtos {
    private RecordDtos() {}

    /** Either enquiryId (buyer and property are taken from it) or propertyId + buyerId. */
    public record SaleInput(Long enquiryId, Long propertyId, Long buyerId,
                            @NotNull @DecimalMin("1") BigDecimal finalAmount,
                            @DecimalMin("0") BigDecimal downPayment,
                            @NotNull LocalDate dealDate, LocalDate registryDate,
                            @DecimalMin("0") BigDecimal totalCommission,
                            boolean advanceReceived, boolean balanceReceived,
                            String status, String notes) {}

    public record SaleView(Long id, Long enquiryId, Long propertyId, String propertyTitle, Long buyerId, String buyerName,
                           String buyerPhone, Long sellerId, String sellerName, String sellerPhone, BigDecimal finalAmount,
                           BigDecimal downPayment, LocalDate dealDate, LocalDate registryDate, BigDecimal totalCommission,
                           boolean advanceReceived, boolean balanceReceived, String status, String notes,
                           LocalDateTime createdAt) {}

    public record RentalInput(Long enquiryId, Long propertyId, Long tenantId,
                              @NotNull @DecimalMin("1") BigDecimal rentAmount,
                              @NotNull @DecimalMin("0") BigDecimal securityDeposit,
                              @NotNull LocalDate startDate, @NotNull LocalDate endDate, LocalDate renewalDate,
                              String status, String notes) {}

    public record RentalView(Long id, Long enquiryId, Long propertyId, String propertyTitle, Long tenantId, String tenantName,
                             String tenantPhone, BigDecimal rentAmount, BigDecimal securityDeposit, LocalDate startDate,
                             LocalDate endDate, LocalDate renewalDate, String status, String notes, LocalDateTime createdAt) {}
}
