package com.example.properity_project.repository;

import com.example.properity_project.entity.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {

    Optional<VerificationToken> findFirstByUserIdAndChannelAndPurposeAndUsedAtIsNullOrderByIdDesc(
            Long userId, String channel, String purpose);

    @Modifying
    @Query("update VerificationToken t set t.usedAt = :now where t.userId = :uid and t.channel = :ch "
            + "and t.purpose = :purpose and t.usedAt is null")
    void invalidateOpen(@Param("uid") Long userId, @Param("ch") String channel,
                        @Param("purpose") String purpose, @Param("now") LocalDateTime now);
}
