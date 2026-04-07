package com.archivehub.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    private String fullname;
    private String firstname;
    private String lastname;

    @Column(columnDefinition = "TEXT")
    private String bio;

    private String profilePhotoUrl;
    private String institution;
    private String rollNumber;
    private String department;
    private String facultyId;

    @Enumerated(EnumType.STRING)
    private Role role;

    private LocalDateTime joinedAt;
    private Double cgpa;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_sgpas", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "semester_index")
    @Column(name = "sgpa")
    private List<Double> semesterSgpas = new ArrayList<>();

    private Double attendancePercentage;
    private LocalDateTime academicStatsLastUpdated;
}
