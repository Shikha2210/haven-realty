package com.example.properity_project.service;

import com.example.properity_project.entity.AuditLog;
import com.example.properity_project.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository repo;

    public void log(Long actorId, String action, String entityType, Long entityId, String details) {
        repo.save(AuditLog.builder().actorId(actorId).action(action).entityType(entityType)
                .entityId(entityId).details(details).build());
    }
}
