package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "rental_agreements")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RentalAgreement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long enquiryId;
    private Long propertyId;
    private Long tenantId;
    private BigDecimal rentAmount;
    private BigDecimal securityDeposit;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate renewalDate;
    @Builder.Default
    private String status = "ACTIVE";
    private String notes;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
