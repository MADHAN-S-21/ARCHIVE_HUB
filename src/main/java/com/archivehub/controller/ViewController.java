package com.archivehub.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping("/")
    public ResponseEntity<Resource> root() {
        return html("static/login.html");
    }

    @GetMapping("/login")
    public ResponseEntity<Resource> login() {
        return html("static/login.html");
    }

    @GetMapping("/signup")
    public ResponseEntity<Resource> signup() {
        return html("static/signup.html");
    }

    private ResponseEntity<Resource> html(String classpathLocation) {
        Resource resource = new ClassPathResource(classpathLocation);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(resource);
    }
}
