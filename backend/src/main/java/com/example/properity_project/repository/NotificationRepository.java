package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findTop50ByUserIdOrderByIdDesc(Long userId);
    long countByUserIdAndReadFlagFalse(Long userId);
    List<Notification> findTop5ByUserIdOrderByIdDesc(Long userId);
}
