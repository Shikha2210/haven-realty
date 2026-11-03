package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "buyer_agent_messages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BuyerAgentMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long enquiryId;
    private String senderRole;
    private Long senderId;
    private String body;
    @Builder.Default
    private boolean internalNote = false;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
