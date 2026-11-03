package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.SiteVisit;

public interface SiteVisitRepository extends JpaRepository<SiteVisit, Long> {
    List<SiteVisit> findByEnquiryIdOrderByScheduledAtAsc(Long enquiryId);
}
