#!/usr/bin/env python3
"""
Regenerate DevOps / Kubernetes / Linux index pages (devops.mdx, kubernetes.mdx,
linux.mdx) as single-row article lists sorted by git modified date (newest first).

Each index page lists every article in its section as a full-width horizontal
Card (one article per row, like a blog feed), wrapped in a
[data-tb-article-list] container. scripts/article-pagination.js paginates the
list client-side (5 per page by default, see data-page-size).

Usage:
    python3 scripts/generate-index-pages.py

Run this after adding, renaming, or updating articles so the index order
matches the latest git modified dates. Card titles and full previews are drawn
from each article's frontmatter; icon choices are varied but repeatable.
"""
import hashlib
import html
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE_SIZE = 5
ICON_POOL = [
    "sparkles", "code-xml", "layers-3", "server", "cpu", "database",
    "network", "terminal", "shield-check", "workflow", "boxes", "book-open",
]

# section -> index file, intro paragraph, [(article path, icon, short summary)]
SECTIONS = {
    "DevOps": (
        "devops.mdx",
        "This section brings together practical DevOps guides for building reliable software delivery workflows. Articles are sorted by most recently updated.",
        [
            ("devops/bruno-the-next-evolution-of-git-friendly-api-testing-tool", "send",
             "Explore Bruno v3's YAML-based OpenCollection format, stronger Git integration, and CI/CD-friendly API testing workflows."),
            ("devops/introduction_about_terraform", "blocks",
             "Learn Terraform fundamentals, Infrastructure as Code concepts, and how to define and provision infrastructure declaratively."),
            ("devops/step_by_step_guide_about_docker_image_build", "container",
             "Follow a practical walkthrough for creating, packaging, and managing applications with Docker images and containers."),
        ],
    ),
    "Kubernetes": (
        "kubernetes.mdx",
        "This section collects practical Kubernetes guides for learning how clusters run and how workloads are managed in production. Articles are sorted by most recently updated.",
        [
            ("kubernetes/introduction_about_kubernetes_and_basics", "boxes",
             "Understand Kubernetes core concepts, architecture, and how it manages containerized workloads across clusters."),
            ("kubernetes/propagate_sigterm_to_k8s_pod", "activity",
             "Learn why SIGTERM may not reach your app in a pod and how to handle graceful shutdowns correctly."),
            ("kubernetes/redis-cluster_deployment_on_kubernetes", "database",
             "Deploy and configure a Redis Cluster on Kubernetes for scalable, highly available in-memory data storage."),
            ("kubernetes/snooze_ultra_minimal_webserver_which_does_nothing", "server",
             "Use Snooze as a lightweight HTTP server for Kubernetes testing, service mesh validation, and reverse-proxy scenarios."),
        ],
    ),
    "Linux": (
        "linux.mdx",
        "This section brings together practical Linux guides for learning the command line, systems, networking, and everyday administration. Articles are sorted by most recently updated.",
        [
            ("linux/booting_process_of_computer_system", "power",
             "Learn the sequence of hardware and software steps involved in booting a computer system from power-on to operating system load."),
            ("linux/configure_mysql_cluster_master_master_synchronization", "database",
             "Set up MySQL master-master synchronization for high availability and distributed database writes across servers."),
            ("linux/filesystem_overview_functionality", "hard-drive",
             "Explore how file systems organize, store, and manage data on disks and partitions in operating systems."),
            ("linux/how_to_disable_ipv6_on_centos", "network",
             "Follow practical steps to disable IPv6 on CentOS when your environment requires IPv4-only networking."),
            ("linux/how_to_mount_qcow2_image_in_linux", "disc",
             "Mount qcow2 disk images on a Linux host to recover data, edit files, or perform maintenance without booting the VM."),
            ("linux/introduction_about_computer_network", "globe",
             "Get a foundation in computer networking concepts, including topology, nodes, devices, and data transmission."),
            ("linux/linux_users_and_groups_management", "users",
             "Manage Linux users, groups, permissions, and access control for secure multi-user systems."),
            ("linux/mysql_high_availability_with_keepalived_and_haproxy", "shield-check",
             "Build a highly available MySQL setup using Keepalived for failover and HAProxy for load balancing."),
            ("linux/network_file_system_overview_and_configuration", "folder-sync",
             "Configure and use NFS to share and access files across Linux systems over a network."),
            ("linux/openssh_overview_and_usage", "terminal",
             "Learn OpenSSH basics for secure remote access, authentication, and encrypted network communication."),
            ("linux/raid_overview_and_functionalities", "layers",
             "Understand RAID levels, redundancy, performance tradeoffs, and how storage arrays protect data."),
            ("linux/recursive_directory_list_in_c_using_linux_system_calls", "folder-tree",
             "Implement recursive directory traversal in C with Linux system calls for practical filesystem programming."),
            ("linux/setup_gpgkey_for_github_commit", "key-round",
             "Configure GPG keys to sign GitHub commits and verify the authenticity of your source code changes."),
            ("linux/tcp_keepalive_configuration_guide", "cable",
             "Configure TCP keepalive and load balancer timeouts to detect dead connections and improve reliability."),
            ("linux/understanding_swap_in_linux", "cpu",
             "Learn how Linux swap space works, when it helps, and how to size it for your workloads."),
            ("linux/useful_commands_with_find_utility", "search",
             "Use the Linux `find` utility to locate files and directories efficiently with practical command examples."),
            ("linux/understanding_so_keepalive_the_definitive_guide", "shield",
             "Understand Nginx `so_keepalive`, TCP-level keepalive behavior, and how it differs from HTTP keep-alive."),
        ],
    ),
}

FRONTMATTER = {
    "DevOps": ("DevOps Tutorials", "Practical DevOps guides for infrastructure, delivery, and automation."),
    "Kubernetes": ("Kubernetes Tutorials", "Practical Kubernetes guides for learning, deploying, and operating clusters."),
    "Linux": ("Linux Tutorials", "Practical Linux guides for systems, tools, and everyday administration."),
}


def git_modified_date(rel_path: str) -> str:
    """Last git commit date (YYYY-MM-DD) for a file; falls back to file mtime."""
    try:
        out = subprocess.check_output(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", f"{rel_path}.mdx"],
            cwd=str(ROOT), text=True,
        ).strip()
        if out:
            return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    fp = ROOT / f"{rel_path}.mdx"
    if fp.exists():
        import datetime
        return datetime.datetime.fromtimestamp(fp.stat().st_mtime).strftime("%Y-%m-%d")
    return "1970-01-01"


def frontmatter_value(rel_path: str, key: str) -> str:
    fp = ROOT / f"{rel_path}.mdx"
    text = fp.read_text(errors="ignore") if fp.exists() else ""
    match = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return ""
    value = re.search(rf'^{re.escape(key)}:\s*["\']?(.*?)["\']?\s*$', match.group(1), re.MULTILINE)
    return value.group(1).strip() if value else ""


def article_title(rel_path: str) -> str:
    return frontmatter_value(rel_path, "title") or rel_path.rsplit("/", 1)[-1].replace("_", " ").replace("-", " ").title()


def article_icon(rel_path: str) -> str:
    """Choose a varied, repeatable icon per article so rebuilds stay clean."""
    digest = hashlib.sha256(rel_path.encode("utf-8")).digest()
    return ICON_POOL[int.from_bytes(digest[:4], "big") % len(ICON_POOL)]


def render_section(section: str) -> str:
    index_file, intro, articles = SECTIONS[section]
    title, description = FRONTMATTER[section]

    # Automatically include every article and use its full frontmatter
    # description so index cards provide a useful preview, not a short teaser.
    fallback_summaries = {path: summary for path, _, summary in articles}
    article_paths = sorted(
        fp.relative_to(ROOT).with_suffix("").as_posix()
        for fp in (ROOT / section.lower()).glob("*.mdx")
    )
    rows = []
    for path in article_paths:
        art_title = article_title(path)
        modified = git_modified_date(path)
        summary = frontmatter_value(path, "description")
        if len(summary) < 120:
            summary = fallback_summaries.get(path) or (
                f"Explore the {section} guide “{art_title}”, with practical concepts, "
                "examples, and implementation details to help you apply it."
            )
        published = frontmatter_value(path, "date")
        date_kind = "Published" if published else "Updated"
        published = published or modified
        rows.append((modified, published, date_kind, path, article_icon(path), summary, art_title))

    # Newest modified first; paths provide deterministic ordering for date ties.
    rows.sort(key=lambda r: r[3])
    rows.sort(key=lambda r: r[0], reverse=True)

    lines = [
        "---",
        f"title: {title}",
        f"description: '{description}'",
        "hidden: true",
        "landingPage: true",
        "---",
        "",
        intro,
        "",
        "## Articles",
        "",
        f'<div className="tb-article-list" data-tb-article-list data-page-size="{PAGE_SIZE}">',
    ]
    for modified, published, date_kind, path, icon, summary, art_title in rows:
        safe_title = html.escape(art_title, quote=True)
        safe_published = html.escape(published, quote=True)
        lines += [
            f'  <div className="tb-article-item" data-tb-article-item data-date="{modified}" data-display-date="{safe_published}" data-date-kind="{date_kind}" data-title="{safe_title}" data-href="/{path}">',
            f'    <Card title="{safe_title}" href="/{path}" icon="{icon}" horizontal={{true}} cta="Read more">',
            f"      {summary}",
            "    </Card>",
            "  </div>",
            "",
        ]
    lines.append("</div>")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    for section, (index_file, _, _) in SECTIONS.items():
        out = ROOT / index_file
        out.write_text(render_section(section))
        print(f"wrote {index_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
