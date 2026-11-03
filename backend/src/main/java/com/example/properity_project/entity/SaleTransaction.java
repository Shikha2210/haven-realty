package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "sale_transactions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaleTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long enquiryId;
    private Long propertyId;
    private Long buyerId;
    private Long sellerId;
    private BigDecimal finalAmount;
    @Builder.Default
    private BigDecimal downPayment = BigDecimal.ZERO;
    private LocalDate dealDate;
    private LocalDate registryDate;
    @Builder.Default
    private BigDecimal totalCommission = BigDecimal.ZERO;
    @Builder.Default
    private boolean advanceReceived = false;
    @Builder.Default
    private boolean balanceReceived = false;
    @Builder.Default
    private String status = "ONGOING";
    private String notes;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
