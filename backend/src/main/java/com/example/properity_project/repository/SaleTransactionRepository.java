package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.SaleTransaction;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleTransactionRepository extends JpaRepository<SaleTransaction, Long> {
    Optional<SaleTransaction> findFirstByEnquiryIdOrderByIdDesc(Long enquiryId);
    boolean existsByPropertyIdAndStatus(Long propertyId, String status);
    long countByStatus(String status);
    @Query("select t.status, count(t) from SaleTransaction t group by t.status")
    List<Object[]> countByStatusGrouped();
}
