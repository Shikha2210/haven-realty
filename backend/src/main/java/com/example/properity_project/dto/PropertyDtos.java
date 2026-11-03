package com.example.properity_project.dto;

import com.example.properity_project.dto.VerificationDtos.DocView;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class PropertyDtos {
    private PropertyDtos() {}

    public record PropertyInput(
            @NotBlank(message = "Title is required") @Size(max = 200) String title,
            @NotBlank(message = "Property type is required") String propertyType,
            @Pattern(regexp = "SALE|RENT", message = "Choose Sale or Rent") String category,
            @Size(max = 5000) String description,
            @NotBlank(message = "City is required") String city,
            String locality,
            @NotBlank(message = "Address is required") @Size(max = 300) String address,
            @Pattern(regexp = "|\\d{6}", message = "Enter a 6-digit PIN code") String postalCode,
            @NotNull(message = "Area is required") @DecimalMin(value = "0.01", message = "Area must be positive") BigDecimal area,
            String measurementUnit,
            @NotNull(message = "Price is required") @DecimalMin(value = "1", message = "Price must be positive") BigDecimal price,
            @Min(0) @Max(50) Integer bedrooms,
            @Min(0) @Max(50) Integer bathrooms,
            String furnishingStatus,
            boolean parkingAvailable,
            @Size(max = 1000) String amenities,
            String constructionType,
            String facing,
            String approvedBy) {}

    /** Public listing card. Contains nothing about the owner. */
    public record PropertyCard(Long id, String title, String propertyType, String category, String city,
                               String locality, BigDecimal price, BigDecimal area, String measurementUnit,
                               Integer bedrooms, Integer bathrooms, String furnishingStatus,
                               String coverImageUrl, boolean verified, boolean wishlisted,
                               LocalDateTime listedAt) {}

    /** Public detail. Seller identity and contact are never included; enquiries go through the agent. */
    public record PropertyDetail(PropertyCard card, String description, String postalCode, boolean parkingAvailable,
                                 List<String> amenities, List<String> imageUrls, String constructionType,
                                 String facing, String approvedBy, String contactedThrough) {}

    public record ImageView(Long id, String url) {}

    public record SellerProperty(Long id, String title, String propertyType, String category, String description,
                                 String city, String locality, String address, String postalCode, BigDecimal area,
                                 String measurementUnit, BigDecimal price, Integer bedrooms, Integer bathrooms,
                                 String furnishingStatus, boolean parkingAvailable, String amenities,
                                 String constructionType, String facing, String approvedBy, String status,
                                 String rejectionReason, int viewCount, long enquiryCount,
                                 List<ImageView> images, List<DocView> documents,
                                 LocalDateTime createdAt, LocalDateTime updatedAt) {}

    public record SellerSummary(Long id, String name, String email, String phone, String city) {}

    public record ApprovalView(String decision, String reason, LocalDateTime at) {}

    public record AgentProperty(SellerProperty property, SellerSummary seller, List<ApprovalView> approvals) {}

    public record PropertyDecision(@NotBlank String action, String reason) {}

    public record StatusChange(@NotBlank String status, String reason) {}
}
