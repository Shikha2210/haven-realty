package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.PropertyApproval;

public interface PropertyApprovalRepository extends JpaRepository<PropertyApproval, Long> {
    List<PropertyApproval> findByPropertyIdOrderByIdAsc(Long propertyId);
}
