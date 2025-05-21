<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $url = "YOUR_GOOGLE_SCRIPT_URL";
    $data = [
        'name'    => $_POST['name'],
        'email'   => $_POST['email'],
        'subject' => $_POST['subject'],
        'message' => $_POST['message']
    ];
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/json",
            'method'  => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    echo $result === false ? "Error submitting form!" : "Success!";
}
?>