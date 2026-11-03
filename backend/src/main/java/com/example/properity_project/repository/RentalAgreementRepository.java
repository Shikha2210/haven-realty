package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.RentalAgreement;

public interface RentalAgreementRepository extends JpaRepository<RentalAgreement, Long> {
    Optional<RentalAgreement> findFirstByEnquiryIdOrderByIdDesc(Long enquiryId);
    long countByStatus(String status);
}
