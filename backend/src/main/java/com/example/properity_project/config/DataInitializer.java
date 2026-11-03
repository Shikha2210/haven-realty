package com.example.properity_project.config;

import com.example.properity_project.entity.User;
import com.example.properity_project.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Provisions THE agent account from AGENT_EMAIL / AGENT_PASSWORD. There is no signup route for agents.
 * If an agent already exists, a second one is never created.
 */
@Component
@Order(1)
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;

    @Value("${app.agent.email:}")
    private String email;
    @Value("${app.agent.password:}")
    private String password;
    @Value("${app.agent.name:Platform Agent}")
    private String name;
    @Value("${app.agent.phone:9000000000}")
    private String phone;

    @Override
    public void run(String... args) {
        if (email.isBlank() || password.isBlank()) {
            log.info("AGENT_EMAIL / AGENT_PASSWORD not set - no agent account provisioned");
            return;
        }
        if (users.countByRole("AGENT") > 0) return;
        users.save(User.builder().fullName(name).email(email.toLowerCase()).password(encoder.encode(password))
                .phone(phone).city("Chandigarh").state("Punjab").role("AGENT")
                .emailVerified(true).phoneVerified(true).buyerEnabled(false).sellerEnabled(false).build());
        log.info("Agent account created for {}", email);
    }
}
