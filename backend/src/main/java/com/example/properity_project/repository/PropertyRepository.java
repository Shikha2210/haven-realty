package com.example.properity_project.repository;

import com.example.properity_project.entity.Property;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PropertyRepository extends JpaRepository<Property, Long>, JpaSpecificationExecutor<Property> {
    List<Property> findBySellerIdOrderByIdDesc(Long sellerId);
    Page<Property> findByStatusIn(Collection<String> statuses, Pageable pageable);
    long countByStatus(String status);
    long countBySellerId(Long sellerId);
    long countBySellerIdAndStatus(Long sellerId, String status);

    @Query("select coalesce(sum(p.viewCount),0) from Property p where p.sellerId = :sid")
    long sumViewsBySeller(@Param("sid") Long sellerId);

    @Query("select p.propertyType, count(p) from Property p group by p.propertyType")
    List<Object[]> countByType();

    @Query("select p.status, count(p) from Property p group by p.status")
    List<Object[]> countByStatusGrouped();

    @Query("select p from Property p where p.status in :statuses and "
            + "(lower(p.title) like :q or lower(p.city) like :q or lower(p.address) like :q)")
    Page<Property> adminSearch(@Param("statuses") Collection<String> statuses, @Param("q") String q, Pageable pageable);
}
