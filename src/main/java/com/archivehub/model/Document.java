package com.archivehub.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "documents")
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String type;
    private Long size; // In bytes
    private LocalDateTime uploadDate;
    private Long ownerId;
    private String ownerName;
    private Long collectionId;
    
    @Column(length = 1000)
    private String url;
    
    private boolean isPersonal;
}
