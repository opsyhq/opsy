# EKS Cluster Upgrade Runbook

This runbook guides opsy through upgrading an EKS cluster.

## Pre-Upgrade Checks

1. Check current cluster version
2. List all node groups and their versions
3. Check for deprecated API versions in use
4. Verify cluster addons compatibility

## Upgrade Steps

### 1. Update Control Plane

```
aws eks update-cluster-version --name <cluster-name> --kubernetes-version <target-version>
```

Wait for cluster status to be ACTIVE.

### 2. Update Node Groups

For each managed node group:

```
aws eks update-nodegroup-version --cluster-name <cluster-name> --nodegroup-name <nodegroup-name>
```

### 3. Update Addons

Update core addons to compatible versions:
- coredns
- kube-proxy
- vpc-cni
- aws-ebs-csi-driver (if installed)

```
aws eks update-addon --cluster-name <cluster-name> --addon-name <addon-name> --addon-version <version>
```

### 4. Verify Upgrade

- Check all nodes are Ready
- Verify pods are running
- Test application connectivity

## Rollback

If issues occur:
1. Node groups can be rolled back by launching new nodes with previous AMI
2. Control plane cannot be downgraded - restore from backup if needed
