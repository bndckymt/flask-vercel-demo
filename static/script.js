
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const totalElement = document.getElementById("total");
const completedElement = document.getElementById("completed");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const taskCount = document.getElementById("task-count");
const clearCompletedButton = document.getElementById("clear-completed");
const overdueElement = document.getElementById("overdue-count");

let tasks = [];
let currentFilter = "all";

async function apiRequest(url, options = {}) {
    const csrfToken = document.querySelector(
        'meta[name="csrf-token"]'
    ).content;

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Request failed (${response.status}): ${errorText}`
        );
    }

    return response.json();
}

async function loadTasks() {
    try {
        tasks = await apiRequest("/api/tasks");
        renderTasks();
    } catch (error) {
        alert(error.message);
    }
}

function isOverdue(task, today) {
    if (task.completed || !task.due_date) {
        return false;
    }

    const dueDate = new Date(task.due_date + "T00:00:00");
    return dueDate < today;
}

function renderTasks() {
    taskList.replaceChildren();

    // Use one consistent date for all filters and statistics.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "pending") {
            return !task.completed && !isOverdue(task, today);
        }

        if (currentFilter === "completed") {
            return task.completed;
        }

        if (currentFilter === "overdue") {
            return isOverdue(task, today);
        }

        return true;
    });

    filteredTasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item" +
            (task.completed ? " is-complete" : "");

        // Completion checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `Complete ${task.title}`);

        checkbox.addEventListener("change", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        completed: checkbox.checked
                    })
                });

                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        // Task title and due date
        const details = document.createElement("div");
        details.className = "task-details";

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;
        details.appendChild(title);

        if (task.due_date) {
            const dueDateLabel = document.createElement("span");
            dueDateLabel.className = "task-due-date";

            const date = new Date(task.due_date + "T00:00:00");

            dueDateLabel.textContent = `Due ${date.toLocaleDateString(
                undefined,
                {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                }
            )}`;

            if (isOverdue(task, today)) {
                dueDateLabel.classList.add("is-overdue");
                dueDateLabel.textContent += " · Overdue";
            }

            details.appendChild(dueDateLabel);
        }

        // Edit button
        const editButton = document.createElement("button");
        editButton.className = "edit-button";
        editButton.type = "button";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", async () => {
            const newTitle = prompt("Edit task title:", task.title);

            if (newTitle === null) return;

            const updatedTitle = newTitle.trim();

            if (!updatedTitle) {
                alert("Task title cannot be empty.");
                return;
            }

            if (updatedTitle.length > 200) {
                alert("Task title cannot exceed 200 characters.");
                return;
            }

            const newDueDate = prompt(
                "Edit due date (YYYY-MM-DD), or leave blank to remove it:",
                task.due_date || ""
            );

            if (newDueDate === null) return;

            const updatedDueDate = newDueDate.trim();

            if (
                updatedDueDate &&
                !/^\d{4}-\d{2}-\d{2}$/.test(updatedDueDate)
            ) {
                alert("Please enter the date in YYYY-MM-DD format.");
                return;
            }

            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        title: updatedTitle,
                        due_date: updatedDueDate || null
                    })
                });

                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        // Delete button
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "DELETE"
                });

                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        item.append(checkbox, details, editButton, deleteButton);
        taskList.appendChild(item);
    });

    // Statistics always use ALL tasks, not just filtered tasks.
    const completed = tasks.filter(task => task.completed).length;

    const overdue = tasks.filter(task => isOverdue(task, today)).length;

    const percentage = tasks.length
        ? Math.round((completed / tasks.length) * 100)
        : 0;

    totalElement.textContent = tasks.length;
    completedElement.textContent = completed;
    progressText.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    if (overdueElement) {
        overdueElement.textContent = overdue;
    }

    taskCount.textContent = `${tasks.length} ${
        tasks.length === 1 ? "task" : "tasks"
    }`;

    // Show the empty state only when there are no tasks at all.
    emptyState.hidden = tasks.length > 0;

    // Show a filtered empty message when tasks exist but none match.
    let filterEmptyMessage = document.getElementById("filter-empty-message");

    if (!filterEmptyMessage) {
        filterEmptyMessage = document.createElement("p");
        filterEmptyMessage.id = "filter-empty-message";
        filterEmptyMessage.className = "empty-state";
        filterEmptyMessage.textContent = "No tasks match this filter.";
        taskList.after(filterEmptyMessage);
    }

    filterEmptyMessage.hidden =
        tasks.length === 0 || filteredTasks.length > 0;
}

// Clear completed tasks
clearCompletedButton.addEventListener("click", async () => {
    try {
        await apiRequest("/api/tasks/completed", {
            method: "DELETE"
        });

        await loadTasks();
    } catch (error) {
        alert(error.message);
    }
});

// Add a task
form.addEventListener("submit", async event => {
    event.preventDefault();

    const title = input.value.trim();
    const dueDate = document.getElementById("task-due-date").value;

    if (!title) return;

    try {
        await apiRequest("/api/tasks", {
            method: "POST",
            body: JSON.stringify({
                title,
                due_date: dueDate || null
            })
        });

        input.value = "";
        document.getElementById("task-due-date").value = "";

        // Show the newly created task immediately.
        currentFilter = "all";

        document.querySelectorAll(".filter-button").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.filter === "all"
            );
        });

        await loadTasks();
        input.focus();
    } catch (error) {
        alert(error.message);
    }
});

// Task filters
document.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll(".filter-button").forEach(filterButton => {
            filterButton.classList.toggle(
                "active",
                filterButton === button
            );
        });

        renderTasks();
    });
});

// Initial load
loadTasks();
