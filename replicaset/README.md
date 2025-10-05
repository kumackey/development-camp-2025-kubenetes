# ReplicaSet デモ

Pod を落としても ReplicaSet の値を維持しようとする的なデモ
```mermaid
graph TD
    A[ReplicaSet] --> B[Pod 1]
    A --> C[Pod 2]
    A --> D[Pod 3]
    
    B --> |"kubectl delete pod"| E[Pod 1: Terminating]
    E --> |"自動復旧"| F[Pod 1: Running]
    
    style E fill:#ff6b6b,stroke:#d63031,stroke-width:2px
    style F fill:#00b894,stroke:#00a085,stroke-width:2px
```

## デモ手順

### ReplicaSetのデプロイ
```bash
kubectl apply -f replicaset.yaml
```

### 確認
```bash
kubectl get deployment
kubectl get replicaset
kubectl get pods -l tier=frontend
```

### 復旧監視
```bash
kubectl get pods -l tier=frontend -w
```

### Podの削除
- delete one pod
```bash
kubectl delete pod $(kubectl get pods -l tier=frontend -o jsonpath='{.items[0].metadata.name}')
```

- delete two pods
```bash
kubectl delete pod $(kubectl get pods -l tier=frontend -o jsonpath='{.items[0].metadata.name}') $(kubectl get pods -l tier=frontend -o jsonpath='{.items[1].metadata.name}')
```

### 自動復旧の確認
```bash
kubectl get pods -l tier=frontend
```

## クリーンアップ

```bash
kubectl delete -f replicaset.yaml
kubectl get deployment
kubectl get replicaset
kubectl get pods
```

