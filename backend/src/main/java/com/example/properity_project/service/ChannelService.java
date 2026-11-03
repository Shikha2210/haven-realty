package com.example.properity_project.service;

import com.example.properity_project.entity.Property;
import com.example.properity_project.entity.SellerAgentMessage;
import com.example.properity_project.entity.User;
import com.example.properity_project.repository.PropertyRepository;
import com.example.properity_project.repository.SellerAgentMessageRepository;
import com.example.properity_project.repository.UserRepository;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The Seller <-> Agent channel. It is keyed by seller id only, so there is no path in the schema that
 * could connect a seller to a buyer's conversation (those live in buyer_agent_messages).
 */
@Service
@RequiredArgsConstructor
public class ChannelService {

    private final SellerAgentMessageRepository messages;
    private final PropertyRepository properties;
    private final UserRepository users;
    private final NotificationService notifications;

    private Map<String, Object> view(SellerAgentMessage m) {
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("id", m.getId());
        o.put("fromAgent", m.getSenderRole().equals("AGENT"));
        o.put("body", m.getBody());
        o.put("propertyId", m.getPropertyId());
        o.put("createdAt", m.getCreatedAt().toString());
        return o;
    }

    public List<Map<String, Object>> sellerThread(User seller) {
        if (!seller.isSellerEnabled()) throw Errors.forbidden("Seller access required");
        return messages.findBySellerIdOrderByIdAsc(seller.getId()).stream().map(this::view).toList();
    }

    @Transactional
    public Map<String, Object> sellerSend(User seller, String body, Long propertyId) {
        if (!seller.isSellerEnabled()) throw Errors.forbidden("Seller access required");
        if (propertyId != null) {
            properties.findById(propertyId).filter(p -> p.getSellerId().equals(seller.getId()))
                    .orElseThrow(() -> Errors.notFound("Property"));
        }
        SellerAgentMessage m = messages.save(SellerAgentMessage.builder().sellerId(seller.getId()).propertyId(propertyId)
                .senderRole("SELLER").senderId(seller.getId()).body(body.trim()).build());
        notifications.notifyAgent("Message from seller " + seller.getFullName(), body, "/agent/customers/" + seller.getId());
        return view(m);
    }

    public List<Map<String, Object>> agentThread(Long sellerId) {
        return messages.findBySellerIdOrderByIdAsc(sellerId).stream().map(this::view).toList();
    }

    @Transactional
    public Map<String, Object> agentSend(User agent, Long sellerId, String body, Long propertyId) {
        User seller = users.findById(sellerId).filter(User::isSellerEnabled).orElseThrow(() -> Errors.notFound("Seller"));
        if (propertyId != null) {
            Property p = properties.findById(propertyId).orElseThrow(() -> Errors.notFound("Property"));
            if (!p.getSellerId().equals(sellerId)) throw Errors.bad("That property does not belong to this seller");
        }
        SellerAgentMessage m = messages.save(SellerAgentMessage.builder().sellerId(sellerId).propertyId(propertyId)
                .senderRole("AGENT").senderId(agent.getId()).body(body.trim()).build());
        notifications.notify(seller.getId(), "New message from your agent", body, "/seller/messages", true);
        return view(m);
    }
}
