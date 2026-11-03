package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.Enquiry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EnquiryRepository extends JpaRepository<Enquiry, Long> {
    List<Enquiry> findByCustomerIdOrderByIdDesc(Long customerId);
    Page<Enquiry> findByStatusIn(Collection<String> statuses, Pageable pageable);
    long countByStatus(String status);
    long countByCustomerId(Long customerId);
    long countByPropertyId(Long propertyId);
    @Query("select count(e) from Enquiry e where e.propertyId in (select p.id from Property p where p.sellerId = :sid)")
    long countForSeller(@Param("sid") Long sellerId);
    List<Enquiry> findTop5ByCustomerIdOrderByUpdatedAtDesc(Long customerId);
}
