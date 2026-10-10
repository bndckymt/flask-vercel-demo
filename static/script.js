
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

let tasks = [];

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


function renderTasks() {
    taskList.replaceChildren();

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item" +
            (task.completed ? " is-complete" : "");

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

        const details = document.createElement("div");
        details.className = "task-details";

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;

        details.appendChild(title);

        if (task.due_date) {
            const dueDate = document.createElement("span");
            dueDate.className = "task-due-date";

            const date = new Date(task.due_date + "T00:00:00");
            dueDate.textContent = `Due ${date.toLocaleDateString(
                undefined,
                { year: "numeric", month: "short", day: "numeric" }
            )}`;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!task.completed && date < today) {
                dueDate.classList.add("is-overdue");
                dueDate.textContent += " · Overdue";
            }

            details.appendChild(dueDate);
        }

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

        const editButton = document.createElement("button");
editButton.className = "edit-button";
editButton.type = "button";
editButton.textContent = "Edit";

editButton.addEventListener("click", async () => {
    const newTitle = prompt("Edit task title:", task.title);

    if (newTitle === null) return;

    const title = newTitle.trim();

    if (!title) {
        alert("Task title cannot be empty.");
        return;
    }

    if (title.length > 200) {
        alert("Task title cannot exceed 200 characters.");
        return;
    }

    const newDueDate = prompt(
        "Edit due date (YYYY-MM-DD), or leave blank to remove it:",
        task.due_date || ""
    );

    if (newDueDate === null) return;

    const dueDate = newDueDate.trim();

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        alert("Please enter the date in YYYY-MM-DD format.");
        return;
    }

    try {
        await apiRequest(`/api/tasks/${task.id}`, {
            method: "PATCH",
            body: JSON.stringify({
                title,
                due_date: dueDate || null
            })
        });

        await loadTasks();
    } catch (error) {
        alert(error.message);
    }
});

item.append(checkbox, details, editButton, deleteButton);
        taskList.appendChild(item);
    });

    const completed = tasks.filter(task => task.completed).length;
    const percentage = tasks.length
        ? Math.round(completed / tasks.length * 100)
        : 0;

    totalElement.textContent = tasks.length;
    completedElement.textContent = completed;
    progressText.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    taskCount.textContent = `${tasks.length} ${
        tasks.length === 1 ? "task" : "tasks"
    }`;

    emptyState.hidden = tasks.length > 0;
}

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

        await loadTasks();
        input.focus();
    } catch (error) {
        alert(error.message);
    }
});


loadTasks();
