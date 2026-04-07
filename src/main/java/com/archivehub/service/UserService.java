package com.archivehub.service;

import com.archivehub.model.Role;
import com.archivehub.model.User;
import com.archivehub.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@SuppressWarnings("null")
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CollectionService collectionService;

    public UserService() {
    }

    @PostConstruct
    public void init() {
        // Initialize with a dedicated admin account if not exists
        if (userRepository.findByEmail("admin@gmail.com").isEmpty()) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setEmail("admin@gmail.com");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setFullname("ADMIN");
            admin.setFirstname("System");
            admin.setLastname("Administrator");
            admin.setBio("System administrator for ArchiveHub.");
            admin.setRole(Role.ADMIN);
            admin.setJoinedAt(LocalDateTime.now().minusMonths(6));
            register(admin);
        }

        // Sample Faculty Account if not exists
        if (userRepository.findByEmail("faculty@faculty.gmail.com").isEmpty()) {
            User faculty = new User();
            faculty.setUsername("faculty");
            faculty.setEmail("faculty@faculty.gmail.com");
            faculty.setPassword(passwordEncoder.encode("staff123"));
            faculty.setFullname("FACULTY");
            faculty.setRole(Role.FACULTY);
            faculty.setJoinedAt(LocalDateTime.now().minusMonths(2));
            register(faculty);
        }
    }

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    public User register(User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("Email already in use");
        }
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            throw new RuntimeException("Username already in use");
        }

        if (user.getJoinedAt() == null) {
            user.setJoinedAt(LocalDateTime.now());
        }

        if (user.getPassword() != null && !user.getPassword().startsWith("$2a$")) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }

        if (user.getRole() == null) {
            String email = user.getEmail().toLowerCase();
            if ("admin@gmail.com".equals(email)) {
                user.setRole(Role.ADMIN);
            } else if (email.endsWith("@faculty.gmail.com")) {
                user.setRole(Role.FACULTY);
            } else {
                user.setRole(Role.STUDENT);
            }
        }

        // Save first so we have the ID for the root collection
        User savedUser = userRepository.save(user);

        if (savedUser.getRole() == Role.STUDENT) {
            com.archivehub.model.Collection rootCol = new com.archivehub.model.Collection();
            rootCol.setName(savedUser.getFullname() != null ? savedUser.getFullname().toUpperCase() : savedUser.getUsername().toUpperCase());
            rootCol.setOwnerId(savedUser.getId());
            rootCol.setDescription("Root collection for " + savedUser.getUsername());
            collectionService.createCollection(rootCol);
        }

        return savedUser;
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User findByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    public User authenticate(String identifier, String password) {
        User user = findByEmail(identifier);
        if (user == null) {
            user = findByUsername(identifier);
        }

        if (user != null && passwordEncoder.matches(password, user.getPassword())) {
            return user;
        }
        return null;
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public User updateUser(Long id, Map<String, Object> updates) {
        User user = getUserById(id);
        if (user == null) {
            throw new RuntimeException("Student not found");
        }

        if (updates.containsKey("fullname"))
            user.setFullname((String) updates.get("fullname"));
        if (updates.containsKey("firstname"))
            user.setFirstname((String) updates.get("firstname"));
        if (updates.containsKey("lastname"))
            user.setLastname((String) updates.get("lastname"));
        if (updates.containsKey("bio"))
            user.setBio((String) updates.get("bio"));
        if (updates.containsKey("profilePhotoUrl"))
            user.setProfilePhotoUrl((String) updates.get("profilePhotoUrl"));
        if (updates.containsKey("institution"))
            user.setInstitution((String) updates.get("institution"));
        if (updates.containsKey("rollNumber") && user.getRollNumber() == null) {
            user.setRollNumber((String) updates.get("rollNumber"));
        }
        if (updates.containsKey("department") && user.getDepartment() == null) {
            user.setDepartment((String) updates.get("department"));
        }
        if (updates.containsKey("facultyId") && user.getFacultyId() == null) {
            user.setFacultyId((String) updates.get("facultyId"));
        }
        if (updates.containsKey("cgpa") || updates.containsKey("semesterSgpas") || updates.containsKey("attendancePercentage")) {
            user.setAcademicStatsLastUpdated(LocalDateTime.now());
        }

        if (updates.containsKey("cgpa")) {
            Object cgpaObj = updates.get("cgpa");
            user.setCgpa(cgpaObj instanceof Number ? ((Number) cgpaObj).doubleValue() : null);
        }
        if (updates.containsKey("semesterSgpas")) {
            Object sgpaObj = updates.get("semesterSgpas");
            if (sgpaObj instanceof java.util.List) {
                java.util.List<?> list = (java.util.List<?>) sgpaObj;
                java.util.List<Double> newSgpas = new java.util.ArrayList<>();
                for (Object item : list) {
                    if (item instanceof Number) {
                        newSgpas.add(((Number) item).doubleValue());
                    } else if (item instanceof String) {
                        try {
                            newSgpas.add(Double.parseDouble((String) item));
                        } catch (NumberFormatException e) {
                            newSgpas.add(0.0);
                        }
                    } else {
                        newSgpas.add(0.0);
                    }
                }
                user.setSemesterSgpas(newSgpas);
            }
        }
        if (updates.containsKey("attendancePercentage")) {
            Object attObj = updates.get("attendancePercentage");
            user.setAttendancePercentage(attObj instanceof Number ? ((Number) attObj).doubleValue() : null);
        }

        return userRepository.save(user);
    }

    public Collection<User> getAllUsers() {
        return userRepository.findAll();
    }
}
