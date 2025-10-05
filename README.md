# development-camp-2025-kubenetes

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

## HPA(Horizontal Pod Autoscaling)

[HPA の設定をすれば負荷があがるとうまく対応してくれるよ的なデモ](./hpa/README.md)

## 通信制御

### 一般的な web server

```mermaid
graph TD
    C[Client] --> LB[Ingress-managed Load Balancer]
    LB --> I[Ingress]
    
    subgraph K8S["Kubernetes Cluster"]
        I --> |"routing rule1"| S1[Service]
        I --> |"routing rule2"| S2[Service]
        S1 --> P1[Pod 1]
        S1 --> P2[Pod 2]
        S2 --> P3[Pod 3]
        S2 --> P4[Pod 4]
    end
```

ref: https://kubernetes.io/docs/concepts/services-networking/ingress/#what-is-ingress

Ingress は minikube では arm64 では試せなかったので、設定例だけ載せておく: https://kubernetes.io/docs/concepts/services-networking/ingress/#hostname-wildcards

### Service 間通信

デモする

## 補足: control plane と worker node

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

今回は minikube を使っている

ref: https://minikube.sigs.k8s.io/docs/
