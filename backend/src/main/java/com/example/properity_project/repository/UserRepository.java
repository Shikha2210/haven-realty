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

    /** q is always a LIKE pattern ("%" when no search text) so no NULL binds are needed. */
    @Query("select u from User u where u.role = 'CUSTOMER' and "
            + "(lower(u.fullName) like :q or lower(u.email) like :q or u.phone like :q)")
    Page<User> searchCustomers(@Param("q") String q, Pageable pageable);

    @Query("select u from User u where u.role = 'CUSTOMER' and u.sellerEnabled = true and "
            + "(lower(u.fullName) like :q or lower(u.email) like :q or u.phone like :q)")
    Page<User> searchSellers(@Param("q") String q, Pageable pageable);
}
