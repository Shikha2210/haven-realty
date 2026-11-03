package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "recently_viewed")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecentlyViewed {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private Long propertyId;
    @Builder.Default
    private LocalDateTime viewedAt = LocalDateTime.now();
}
