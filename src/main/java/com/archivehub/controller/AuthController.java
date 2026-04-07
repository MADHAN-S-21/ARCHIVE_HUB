package com.archivehub.controller;

import com.archivehub.model.User;
import com.archivehub.model.UserRequest;
import com.archivehub.service.UserRequestService;
import com.archivehub.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRequestService userRequestService;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody UserRequest request) {
        try {
            if (request.getRole() == null) {
                if (request.getEmail() != null && request.getEmail().endsWith("@faculty.gmail.com")) {
                    request.setRole(com.archivehub.model.Role.FACULTY);
                } else {
                    request.setRole(com.archivehub.model.Role.STUDENT);
                }
            }
            userRequestService.addRequest(request);
            return ResponseEntity
                    .ok(Map.of("message", "Registration request sent to Admin. Please wait for approval."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> credentials) {
        String identifier = credentials.get("username"); // Can be email or username
        String password = credentials.get("password");

        if (identifier == null || password == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Missing credentials"));
        }

        User user = userService.authenticate(identifier, password);
        if (user != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("token", "mock-jwt-token-" + System.currentTimeMillis());
            response.put("id", user.getId());
            response.put("username", user.getUsername());
            response.put("email", user.getEmail());
            response.put("fullname", user.getFullname());
            response.put("role", user.getRole());
            response.put("profilePhotoUrl", user.getProfilePhotoUrl());

            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid credentials"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser(jakarta.servlet.http.HttpSession session) {
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}
