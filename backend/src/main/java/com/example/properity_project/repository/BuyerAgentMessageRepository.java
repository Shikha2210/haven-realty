package com.example.properity_project.repository;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.properity_project.entity.BuyerAgentMessage;

public interface BuyerAgentMessageRepository extends JpaRepository<BuyerAgentMessage, Long> {
    List<BuyerAgentMessage> findByEnquiryIdOrderByIdAsc(Long enquiryId);
    List<BuyerAgentMessage> findByEnquiryIdAndInternalNoteFalseOrderByIdAsc(Long enquiryId);
}
