package com.example.properity_project.service;

import com.example.properity_project.entity.Notification;
import com.example.properity_project.entity.User;
import com.example.properity_project.repository.NotificationRepository;
import com.example.properity_project.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** In-app notifications, optionally mirrored to email for the important events. */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;
    private final UserRepository users;
    private final MailService mail;

    public void notify(Long userId, String title, String body, String link, boolean email) {
        repo.save(Notification.builder().userId(userId).title(title).body(body).link(link).build());
        if (email) {
            users.findById(userId).ifPresent(u -> mail.send(u.getEmail(), title, body == null ? title : body));
        }
    }

    /** Tell the single agent about something (new enquiry, new seller application, ...). */
    public void notifyAgent(String title, String body, String link) {
        users.findFirstByRole("AGENT").ifPresent(a -> notify(a.getId(), title, body, link, false));
    }

    public List<Map<String, Object>> list(User user) {
        return repo.findTop50ByUserIdOrderByIdDesc(user.getId()).stream().map(n -> Map.<String, Object>of(
                "id", n.getId(), "title", n.getTitle(), "body", n.getBody() == null ? "" : n.getBody(),
                "link", n.getLink() == null ? "" : n.getLink(), "read", n.isReadFlag(),
                "createdAt", n.getCreatedAt().toString())).toList();
    }

    public long unread(User user) {
        return repo.countByUserIdAndReadFlagFalse(user.getId());
    }

    @Transactional
    public void markRead(User user, Long id) {
        repo.findById(id).filter(n -> n.getUserId().equals(user.getId())).ifPresent(n -> n.setReadFlag(true));
    }

    @Transactional
    public void markAllRead(User user) {
        repo.findTop50ByUserIdOrderByIdDesc(user.getId()).forEach(n -> n.setReadFlag(true));
    }
}
