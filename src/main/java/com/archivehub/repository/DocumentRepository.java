package com.archivehub.repository;

import com.archivehub.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByOwnerId(Long ownerId);
    List<Document> findByCollectionId(Long collectionId);
    List<Document> findByOwnerIdAndCollectionId(Long ownerId, Long collectionId);
    List<Document> findByOwnerIdAndIsPersonal(Long ownerId, boolean isPersonal);
    boolean existsByCollectionId(Long collectionId);
}
