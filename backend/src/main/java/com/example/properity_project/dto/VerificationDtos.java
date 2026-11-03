package com.example.properity_project.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

public final class VerificationDtos {
    private VerificationDtos() {}

    public record DocView(Long id, String docType, String originalName, LocalDateTime uploadedAt) {}

    public record HistoryView(String fromStatus, String toStatus, String note, LocalDateTime at) {}

    /** What the applicant sees: never the agent's internal review notes. */
    public record MyVerification(Long id, String status, String rejectionReason, boolean consentGiven,
                                 LocalDateTime submittedAt, LocalDateTime reviewedAt,
                                 List<DocView> documents, List<HistoryView> history) {}

    public record AgentVerification(Long id, Long userId, String applicantName, String applicantEmail,
                                    String applicantPhone, String applicantCity, String status,
                                    String rejectionReason, String reviewNotes, boolean consentGiven,
                                    LocalDateTime submittedAt, LocalDateTime reviewedAt,
                                    List<DocView> documents, List<HistoryView> history) {}

    public record DecisionRequest(@NotBlank String action, String reason, String notes) {}
}
