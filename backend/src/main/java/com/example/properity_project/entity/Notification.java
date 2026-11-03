package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String title;
    private String body;
    private String link;
    @Builder.Default
    private boolean readFlag = false;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
