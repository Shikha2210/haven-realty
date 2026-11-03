package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.PropertyOffer;

public interface PropertyOfferRepository extends JpaRepository<PropertyOffer, Long> {
    List<PropertyOffer> findByEnquiryIdOrderByIdAsc(Long enquiryId);
}
