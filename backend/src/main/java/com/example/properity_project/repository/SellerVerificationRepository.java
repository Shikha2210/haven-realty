package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.SellerVerification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SellerVerificationRepository extends JpaRepository<SellerVerification, Long> {
    Optional<SellerVerification> findFirstByUserIdOrderByIdDesc(Long userId);
    Page<SellerVerification> findByStatusIn(Collection<String> statuses, Pageable pageable);
    long countByStatus(String status);
}
