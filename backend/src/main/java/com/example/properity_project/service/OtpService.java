package com.example.properity_project.service;

import com.example.properity_project.entity.User;
import com.example.properity_project.entity.VerificationToken;
import com.example.properity_project.repository.UserRepository;
import com.example.properity_project.repository.VerificationTokenRepository;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Six-digit one-time codes for email verification, phone verification and password reset.
 * Codes are stored hashed. Email goes through MailService; SMS is a log stub (no gateway).
 */
@Service
@RequiredArgsConstructor
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final VerificationTokenRepository tokens;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final MailService mail;

    @Value("${app.dev-expose-otp:false}")
    private boolean exposeOtp;

    public boolean isExposed() {
        return exposeOtp;
    }

    /** Creates and delivers a code. Returns the plain code only so demo mode can show it. */
    @Transactional
    public String issue(User user, String channel, String purpose) {
        tokens.invalidateOpen(user.getId(), channel, purpose, LocalDateTime.now());
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        tokens.save(VerificationToken.builder().userId(user.getId()).channel(channel).purpose(purpose)
                .codeHash(encoder.encode(code)).expiresAt(LocalDateTime.now().plusMinutes(15)).build());
        if ("EMAIL".equals(channel)) {
            String what = "RESET".equals(purpose) ? "reset your password" : "verify your email";
            mail.send(user.getEmail(), "Your Haven Realty code",
                    "Use code " + code + " to " + what + ". It expires in 15 minutes.");
        } else {
            log.info("[SMS stub] code for {} is {}", user.getPhone(), code);
        }
        return code;
    }

    @Transactional
    public void consume(User user, String channel, String purpose, String code) {
        VerificationToken t = tokens.findFirstByUserIdAndChannelAndPurposeAndUsedAtIsNullOrderByIdDesc(
                user.getId(), channel, purpose).orElseThrow(() -> Errors.bad("Invalid or expired code"));
        if (t.getExpiresAt().isBefore(LocalDateTime.now()) || t.getAttempts() >= 5) {
            throw Errors.bad("Invalid or expired code");
        }
        if (code == null || !encoder.matches(code.trim(), t.getCodeHash())) {
            t.setAttempts(t.getAttempts() + 1);
            tokens.save(t);
            throw Errors.bad("Invalid or expired code");
        }
        t.setUsedAt(LocalDateTime.now());
        tokens.save(t);
    }
}
