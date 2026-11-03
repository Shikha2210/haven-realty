package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "properties")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long sellerId;
    private String title;
    private String propertyType;
    private String category;
    private String description;
    private String city;
    private String locality;
    private String address;
    private String postalCode;
    private BigDecimal area;
    @Builder.Default
    private String measurementUnit = "sq ft";
    private BigDecimal price;
    private Integer bedrooms;
    private Integer bathrooms;
    private String furnishingStatus;
    @Builder.Default
    private boolean parkingAvailable = false;
    private String amenities;
    private String constructionType;
    private String facing;
    private String approvedBy;
    @Builder.Default
    private String status = "DRAFT";
    private String rejectionReason;
    @Builder.Default
    private Integer viewCount = 0;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
