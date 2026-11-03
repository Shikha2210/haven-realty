package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.SellerAgentMessage;

public interface SellerAgentMessageRepository extends JpaRepository<SellerAgentMessage, Long> {
    List<SellerAgentMessage> findBySellerIdOrderByIdAsc(Long sellerId);
}
