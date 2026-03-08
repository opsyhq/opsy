# Commands

This skill should only refer to the currently shipped CLI surface.

## Shipped command groups

```text
opsy auth login
opsy auth logout
opsy auth whoami

opsy workspace list

opsy draft list
opsy draft get
opsy draft create
opsy draft write
opsy draft edit
opsy draft validate
opsy draft delete

opsy revision list
opsy revision get
opsy revision delete

opsy run apply
opsy run wait
opsy run get
opsy run list
opsy run import
opsy run cancel

opsy org list
opsy org set
opsy org delete
opsy org get-notes
opsy org set-notes
```

## Usage rule

Do not invent flags or unshipped commands in skill guidance. When exact arguments matter, use local help:

```bash
opsy <group> <command> --help
```

## Install path

The intended public repo layout keeps the skill in:

```text
skills/opsy
```

Install from the GitHub repo or repo subfolder path supported by the client or skill installer you are using.
