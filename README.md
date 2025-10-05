# development-camp-2025-kubenetes

## control plane と worker node

```mermaid
graph TD
    subgraph CP["Control Plane"]
        A[API Server]
        B[etcd]
        C[Scheduler]
        D[Controller Manager]
    end
    
    subgraph WN1["Worker Node 1"]
        E[kubelet]
        F[kube-proxy]
        G[Container Runtime]
    end
    
    subgraph WN2["Worker Node 2"]
        H[kubelet]
        I[kube-proxy]
        J[Container Runtime]
    end
    
    A <--> E
    A <--> H
```

ref: https://kubernetes.io/docs/concepts/overview/components/

今回は minikube を使う

ref: https://minikube.sigs.k8s.io/docs/

## deployment における構成

```mermaid
graph TD
    A[Deployment] --> B[ReplicaSet]
    B --> C[Pod 1]
    B --> D[Pod 2]
    B --> E[Pod 3]
    
    C --> F[Container: web app server]
    D --> G[Container: web app server]
    E --> H[Container: web app server]
```

### ReplicaSet

[Pod を落としても ReplicaSet の値を維持しようとするデモ](./replicaset/README.md)

### (仮)ローリングアップデート

新しいバージョンをリリースしたら、新しい ReplicaSet, Pod がつくられ、古い ReplicaSet が更新される的なデモ

## HPA(Horizontal Pod Autoscaling)

HPA の設定をすれば負荷があがるとうまく対応してくれるよ的なデモ

## プロセス間通信


### 通信制御

#### 一般的な web server として運用するときの図？
```mermaid
graph TD
    U[User] --> I[Ingress]

    subgraph K8S["Kubernetes Cluster"]
        I --> S[Service]
        S --> P1[Pod 1: web server]
        S --> P2[Pod 2: web server]
        S --> P3[Pod 3: web server]
    end
```
[Pod間通信と非同期処理のデモ](./ipc/README.md)

Redis Streamsを使った非同期ワーカーパターン。APIとWorkerを分離し、非同期でタスクを処理する。

```mermaid
graph LR
    Client[Client] -->|NodePort| APIPod[Pod1: hono-api]
    APIPod -->|Enqueue Task| RedisPod[Pod2: redis]
    RedisPod -->|Stream| WorkerPod[Pod3: hono-worker]
    WorkerPod -->|Save Result| RedisPod
    APIPod -->|Get Result| RedisPod
```