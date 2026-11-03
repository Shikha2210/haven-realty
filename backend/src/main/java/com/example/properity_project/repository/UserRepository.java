package com.example.properity_project.repository;

import com.example.properity_project.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    Optional<User> findFirstByRole(String role);
    long countByRole(String role);
    long countByRoleAndSellerEnabledTrue(String role);

    @Query("select u from User u where u.role = 'CUSTOMER' and "
            + "(:q is null or lower(u.fullName) like :q or lower(u.email) like :q or u.phone like :q) and "
            + "(:seller is null or u.sellerEnabled = :seller)")
    Page<User> searchCustomers(@Param("q") String q, @Param("seller") Boolean seller, Pageable pageable);
}
