package com.archivehub.repository;

import com.archivehub.model.Collection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollectionRepository extends JpaRepository<Collection, Long> {
    List<Collection> findByOwnerId(Long ownerId);
    List<Collection> findByParentId(Long parentId);
    boolean existsByParentId(Long parentId);
}
