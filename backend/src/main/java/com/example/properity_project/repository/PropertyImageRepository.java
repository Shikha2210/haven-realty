package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.PropertyImage;

public interface PropertyImageRepository extends JpaRepository<PropertyImage, Long> {
    List<PropertyImage> findByPropertyIdOrderBySortOrderAscIdAsc(Long propertyId);
    Optional<PropertyImage> findFirstByPropertyIdOrderBySortOrderAscIdAsc(Long propertyId);
}
