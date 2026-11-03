package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "seller_agent_messages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerAgentMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long sellerId;
    private Long propertyId;
    private String senderRole;
    private Long senderId;
    private String body;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
