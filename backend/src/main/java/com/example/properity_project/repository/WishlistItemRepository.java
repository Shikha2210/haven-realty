package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.WishlistItem;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
    List<WishlistItem> findByUserIdOrderByIdDesc(Long userId);
    Optional<WishlistItem> findByUserIdAndPropertyId(Long userId, Long propertyId);
}
