package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.VerificationHistory;

public interface VerificationHistoryRepository extends JpaRepository<VerificationHistory, Long> {
    List<VerificationHistory> findByVerificationIdOrderByIdAsc(Long verificationId);
}
